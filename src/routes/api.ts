/// <reference types="@cloudflare/workers-types" />
import { Router } from 'itty-router';
import * as db from '../db';
import * as auth from '../auth';
import { Role } from '../types';
import type { Env, LoginRequest, ScoreUpdateEvent, UpdateScoreRequest, CreateEmployeeData, UpdateEmployeeData, CreateUserData, UpdateUserData } from '../types';

// Create router instance
export const apiRouter = Router({ base: '/api' });

// Authentication routes
apiRouter.post('/login', async (request: Request, env: Env) => {
  try {
    const data: LoginRequest = await request.json();
    
    // Validate input
    if (!data.email || !data.password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Find user by email
    const user = await db.getUserByEmail(env.DB, data.email);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const isValid = await auth.verifyPassword(data.password, user.hashedPassword);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create session
    const sessionId = await auth.createSession(env, user.id, data.remember || false);
    const maxAge = data.remember ? 30 * 24 * 60 * 60 : undefined; // 30 days if remember
    
    // Return user data (excluding sensitive info)
    const { hashedPassword, ...userData } = user;
    
    return new Response(JSON.stringify(userData), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': auth.createSessionCookie(sessionId, maxAge)
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

apiRouter.post('/logout', async (request: Request, env: Env) => {
  const cookie = request.headers.get('Cookie') || '';
  const cookies = auth.parseCookies(cookie);
  const sessionId = cookies['__session'];
  
  if (sessionId) {
    await auth.deleteSession(env, sessionId);
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': '__session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    }
  });
});

apiRouter.get('/me', async (request: Request, env: Env) => {
  const user = await auth.requireAuth(request, env);
  
  if (user instanceof Response) {
    return user;
  }
  
  // Return user data without sensitive fields
  const { hashedPassword, ...userData } = user;
  return new Response(JSON.stringify(userData), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// User routes
apiRouter.get('/users', async (request: Request, env: Env) => {
  // Only admins can list all users
  const user = await auth.requireRole(request, env, [Role.ADMIN]);
  
  if (user instanceof Response) {
    return user;
  }
  
  const users = await db.getUsers(env.DB);
  
  // Filter out sensitive data
  const safeUsers = users.map(({ hashedPassword, ...rest }) => rest);
  
  return new Response(JSON.stringify(safeUsers), {
    headers: { 'Content-Type': 'application/json' }
  });
});

apiRouter.post('/users', async (request: Request, env: Env) => {
  // Only admins can create users
  const currentUser = await auth.requireRole(request, env, [Role.ADMIN]);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  try {
    const data = await request.json() as {
      email: string;
      password: string;
      role: Role;
      employeeId?: number;
    };
    
    // Validate required fields
    if (!data.email || !data.password || !data.role) {
      return new Response(JSON.stringify({ error: 'Email, password, and role are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if email already exists
    const existingUser = await db.getUserByEmail(env.DB, data.email);
    if (existingUser) {
      return new Response(JSON.stringify({ error: 'Email already in use' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Hash password
    const hashedPassword = await auth.hashPassword(data.password);
    
    // Create user
    const newUser = await db.createUser(env.DB, {
      email: data.email,
      hashedPassword,
      role: data.role,
      employeeId: data.employeeId || null
    });
    
    // Return user without sensitive data
    const { hashedPassword: _, ...userData } = newUser;
    
    return new Response(JSON.stringify(userData), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

apiRouter.get('/users/:id', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Only admins or the user themselves can view user details
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const userId = parseInt(context.params.id, 10);
  if (isNaN(userId)) {
    return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is authorized to view this user
  if (currentUser.id !== userId && currentUser.role !== Role.ADMIN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const user = await db.getUserById(env.DB, userId);
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Return user without sensitive data
  const { hashedPassword, ...userData } = user;
  
  return new Response(JSON.stringify(userData), {
    headers: { 'Content-Type': 'application/json' }
  });
});

apiRouter.put('/users/:id', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Only admins or the user themselves can update user details
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const userId = parseInt(context.params.id, 10);
  if (isNaN(userId)) {
    return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Check if user is authorized to update this user
  const isAdmin = currentUser.role === Role.ADMIN;
  const isSelf = currentUser.id === userId;
  
  if (!isAdmin && !isSelf) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const data: UpdateUserData = await request.json() as UpdateUserData;
    
    // Only admins can change roles
    if (data.role && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized to change role' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Hash password if provided
    let updateData: UpdateUserData = { ...data };
    
    if (data.password) {
      updateData.password = await auth.hashPassword(data.password);
    }
    
    const updatedUser = await db.updateUser(env.DB, userId, updateData);
    
    if (!updatedUser) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Return user without sensitive data
    const { hashedPassword, ...userData } = updatedUser;
    
    return new Response(JSON.stringify(userData), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

apiRouter.delete('/users/:id', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Only admins can delete users
  const currentUser = await auth.requireRole(request, env, [Role.ADMIN]);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const userId = parseInt(context.params.id, 10);
  if (isNaN(userId)) {
    return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Prevent self-deletion
  if (userId === currentUser.id) {
    return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const success = await db.deleteUser(env.DB, userId);
  
  if (!success) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Employee routes
apiRouter.get('/employees', async (request: Request, env: Env) => {
  // Any authenticated user can list employees
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employees = await db.getEmployees(env.DB);
  
  return new Response(JSON.stringify(employees), {
    headers: { 'Content-Type': 'application/json' }
  });
});

apiRouter.post('/employees', async (request: Request, env: Env) => {
  // Only admins and managers can create employees
  const currentUser = await auth.requireRole(request, env, [Role.ADMIN, Role.MANAGER]);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  try {
    const data: CreateEmployeeData = await request.json() as CreateEmployeeData;
    
    // Validate required fields
    if (!data.name) {
      return new Response(JSON.stringify({ error: 'Name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create employee
    const newEmployee = await db.createEmployee(env.DB, data);
    
    // Create a score record for the employee
    await db.createScore(env.DB, newEmployee.id);
    
    return new Response(JSON.stringify(newEmployee), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

apiRouter.get('/employees/:id', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Any authenticated user can view employee details
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const employee = await db.getEmployeeById(env.DB, employeeId);
  
  if (!employee) {
    return new Response(JSON.stringify({ error: 'Employee not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify(employee), {
    headers: { 'Content-Type': 'application/json' }
  });
});

apiRouter.put('/employees/:id', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Only admins and managers can update employees
  const currentUser = await auth.requireRole(request, env, [Role.ADMIN, Role.MANAGER]);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const data: UpdateEmployeeData = await request.json() as UpdateEmployeeData;
    
    const updatedEmployee = await db.updateEmployee(env.DB, employeeId, data);
    
    if (!updatedEmployee) {
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(updatedEmployee), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

apiRouter.delete('/employees/:id', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Only admins can delete employees
  const currentUser = await auth.requireRole(request, env, [Role.ADMIN]);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const success = await db.deleteEmployee(env.DB, employeeId);
  
  if (!success) {
    return new Response(JSON.stringify({ error: 'Employee not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Score routes
apiRouter.get('/employees/:id/score', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Any authenticated user can view scores
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const score = await db.getScoreByEmployeeId(env.DB, employeeId);
  
  if (!score) {
    return new Response(JSON.stringify({ error: 'Score not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify(score), {
    headers: { 'Content-Type': 'application/json' }
  });
});

apiRouter.put('/employees/:id/score', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Only admins and managers can update scores
  const currentUser = await auth.requireRole(request, env, [Role.ADMIN, Role.MANAGER]);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const data: UpdateScoreRequest = await request.json() as UpdateScoreRequest;
    
    // Update score
    const updatedScore = await db.updateScore(env.DB, employeeId, data);
    
    if (!updatedScore) {
      return new Response(JSON.stringify({ error: 'Score not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // If day score was updated, add a trend point
    if (data.day !== undefined) {
      await db.createTrendPoint(env.DB, employeeId, data.day);
    }
    
    return new Response(JSON.stringify(updatedScore), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Trend points routes
apiRouter.get('/employees/:id/trends', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Any authenticated user can view trend points
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get limit from query string if present
  const url = new URL(request.url);
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 30;
  
  const trendPoints = await db.getTrendPointsByEmployeeId(env.DB, employeeId, limit);
  
  return new Response(JSON.stringify(trendPoints), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Dashboard data
apiRouter.get('/dashboard', async (request: Request, env: Env) => {
  // Any authenticated user can view dashboard data
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const dashboardData = await db.getDashboardData(env.DB);
  
  return new Response(JSON.stringify(dashboardData), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// Wrong number increment
apiRouter.post('/employees/:id/wrong-number', async (request: Request, env: Env, context: { params: { id: string } }) => {
  // Any authenticated user can increment wrong numbers
  const currentUser = await auth.requireAuth(request, env);
  
  if (currentUser instanceof Response) {
    return currentUser;
  }
  
  const employeeId = parseInt(context.params.id, 10);
  if (isNaN(employeeId)) {
    return new Response(JSON.stringify({ error: 'Invalid employee ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Increment wrong number
    const updatedEmployee = await db.incrementWrongNumber(env.DB, employeeId);
    
    if (!updatedEmployee) {
      return new Response(JSON.stringify({ error: 'Employee not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Also decrement the day score
    const score = await db.getScoreByEmployeeId(env.DB, employeeId);
    
    if (score) {
      const newDayScore = Math.max(0, score.day - 5); // Decrement by 5, minimum 0
      await db.updateScore(env.DB, employeeId, { day: newDayScore });
      await db.createTrendPoint(env.DB, employeeId, newDayScore);
    }
    
    return new Response(JSON.stringify(updatedEmployee), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// Events API for SSE
apiRouter.get('/events', async (request: Request, env: Env) => {
  // Any authenticated user can subscribe to events
  const user = await auth.requireAuth(request, env);
  
  if (user instanceof Response) {
    return user;
  }
  
  // This will be expanded with Durable Objects for SSE
  // For now, we return a simple message
  return new Response(JSON.stringify({ message: 'SSE not yet implemented' }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// 404 handler for API routes
apiRouter.all('*', () => {
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });
}); 