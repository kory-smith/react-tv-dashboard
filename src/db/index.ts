/// <reference types="@cloudflare/workers-types" />
import type { 
  User, Employee, Score, TrendPoint, 
  CreateUserData, UpdateUserData,
  CreateEmployeeData, UpdateEmployeeData,
  Role, UpdateScoreRequest
} from '../types';

// User-related database functions
export async function getUserById(db: D1Database, id: number): Promise<User | null> {
  const stmt = db.prepare('SELECT * FROM User WHERE id = ?').bind(id);
  const user = await stmt.first();
  return user as User | null;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const stmt = db.prepare('SELECT * FROM User WHERE email = ?').bind(email);
  const user = await stmt.first();
  return user as User | null;
}

export async function getUsers(db: D1Database): Promise<User[]> {
  const { results } = await db.prepare('SELECT * FROM User ORDER BY id').all();
  return results as unknown as User[];
}

export async function createUser(db: D1Database, userData: CreateUserData): Promise<User> {
  const { email, hashedPassword, role, employeeId } = userData;
  
  const { meta } = await db.prepare(
    'INSERT INTO User (email, hashedPassword, role, employeeId) VALUES (?, ?, ?, ?)'
  ).bind(email, hashedPassword, role, employeeId).run();
  
  if (!meta.last_row_id) {
    throw new Error('Failed to create user');
  }
  
  return getUserById(db, meta.last_row_id) as Promise<User>;
}

export async function updateUser(db: D1Database, id: number, userData: UpdateUserData): Promise<User | null> {
  // Build dynamic update query based on provided fields
  const updateFields: string[] = [];
  const values: any[] = [];
  
  if (userData.email !== undefined) {
    updateFields.push('email = ?');
    values.push(userData.email);
  }
  
  if (userData.password !== undefined) {
    updateFields.push('hashedPassword = ?');
    values.push(userData.password);
  }
  
  if (userData.role !== undefined) {
    updateFields.push('role = ?');
    values.push(userData.role);
  }
  
  if (userData.employeeId !== undefined) {
    updateFields.push('employeeId = ?');
    values.push(userData.employeeId);
  }
  
  if (updateFields.length === 0) {
    return getUserById(db, id);
  }
  
  // Add id as the last parameter
  values.push(id);
  
  const { success } = await db.prepare(
    `UPDATE User SET ${updateFields.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  if (!success) {
    return null;
  }
  
  return getUserById(db, id);
}

export async function deleteUser(db: D1Database, id: number): Promise<boolean> {
  const { success } = await db.prepare('DELETE FROM User WHERE id = ?').bind(id).run();
  return success;
}

// Employee-related database functions
export async function getEmployeeById(db: D1Database, id: number): Promise<Employee | null> {
  const stmt = db.prepare('SELECT * FROM Employee WHERE id = ?').bind(id);
  const employee = await stmt.first();
  return employee as Employee | null;
}

export async function getEmployeeByName(db: D1Database, name: string): Promise<Employee | null> {
  const stmt = db.prepare('SELECT * FROM Employee WHERE name = ?').bind(name);
  const employee = await stmt.first();
  return employee as Employee | null;
}

export async function getEmployees(db: D1Database): Promise<Employee[]> {
  const { results } = await db.prepare('SELECT * FROM Employee ORDER BY id').all();
  return results as unknown as Employee[];
}

export async function createEmployee(db: D1Database, data: CreateEmployeeData): Promise<Employee> {
  const { name, wrongNumbers = 0 } = data;
  
  const { meta } = await db.prepare(
    'INSERT INTO Employee (name, wrongNumbers) VALUES (?, ?)'
  ).bind(name, wrongNumbers).run();
  
  if (!meta.last_row_id) {
    throw new Error('Failed to create employee');
  }
  
  return getEmployeeById(db, meta.last_row_id) as Promise<Employee>;
}

export async function updateEmployee(db: D1Database, id: number, data: UpdateEmployeeData): Promise<Employee | null> {
  // Build dynamic update query based on provided fields
  const updateFields: string[] = [];
  const values: any[] = [];
  
  if (data.name !== undefined) {
    updateFields.push('name = ?');
    values.push(data.name);
  }
  
  if (data.wrongNumbers !== undefined) {
    updateFields.push('wrongNumbers = ?');
    values.push(data.wrongNumbers);
  }
  
  if (updateFields.length === 0) {
    return getEmployeeById(db, id);
  }
  
  // Add id as the last parameter
  values.push(id);
  
  const { success } = await db.prepare(
    `UPDATE Employee SET ${updateFields.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  if (!success) {
    return null;
  }
  
  return getEmployeeById(db, id);
}

export async function incrementWrongNumber(db: D1Database, id: number): Promise<Employee | null> {
  const { success } = await db.prepare(
    'UPDATE Employee SET wrongNumbers = wrongNumbers + 1 WHERE id = ?'
  ).bind(id).run();
  
  if (!success) {
    return null;
  }
  
  return getEmployeeById(db, id);
}

export async function deleteEmployee(db: D1Database, id: number): Promise<boolean> {
  const { success } = await db.prepare('DELETE FROM Employee WHERE id = ?').bind(id).run();
  return success;
}

// Score-related database functions
export async function getScoreByEmployeeId(db: D1Database, employeeId: number): Promise<Score | null> {
  const stmt = db.prepare('SELECT * FROM Score WHERE employeeId = ?').bind(employeeId);
  const score = await stmt.first();
  return score as Score | null;
}

export async function createScore(db: D1Database, employeeId: number, day = 75, week = 75, month = 75): Promise<Score | null> {
  const { meta } = await db.prepare(
    'INSERT INTO Score (employeeId, day, week, month) VALUES (?, ?, ?, ?)'
  ).bind(employeeId, day, week, month).run();
  
  if (!meta.last_row_id) {
    return null;
  }
  
  return getScoreByEmployeeId(db, employeeId);
}

export async function updateScore(db: D1Database, employeeId: number, data: UpdateScoreRequest): Promise<Score | null> {
  // Get current score first
  const currentScore = await getScoreByEmployeeId(db, employeeId);
  if (!currentScore) {
    return null;
  }
  
  // Build dynamic update query based on provided fields
  const updateFields: string[] = [];
  const values: any[] = [];
  
  if (data.day !== undefined) {
    updateFields.push('day = ?');
    values.push(data.day);
  }
  
  if (data.week !== undefined) {
    updateFields.push('week = ?');
    values.push(data.week);
  }
  
  if (data.month !== undefined) {
    updateFields.push('month = ?');
    values.push(data.month);
  }
  
  if (updateFields.length === 0) {
    return currentScore;
  }
  
  // Add employeeId as the last parameter
  values.push(employeeId);
  
  const { success } = await db.prepare(
    `UPDATE Score SET ${updateFields.join(', ')} WHERE employeeId = ?`
  ).bind(...values).run();
  
  if (!success) {
    return null;
  }
  
  return getScoreByEmployeeId(db, employeeId);
}

// TrendPoint-related database functions
export async function createTrendPoint(db: D1Database, employeeId: number, score: number): Promise<TrendPoint | null> {
  const { meta } = await db.prepare(
    'INSERT INTO TrendPoint (employeeId, score) VALUES (?, ?)'
  ).bind(employeeId, score).run();
  
  if (!meta.last_row_id) {
    return null;
  }
  
  const stmt = db.prepare('SELECT * FROM TrendPoint WHERE id = ?').bind(meta.last_row_id);
  const trendPoint = await stmt.first();
  return trendPoint as TrendPoint | null;
}

export async function getTrendPointsByEmployeeId(db: D1Database, employeeId: number, limit = 30): Promise<TrendPoint[]> {
  const { results } = await db.prepare(
    'SELECT * FROM TrendPoint WHERE employeeId = ? ORDER BY timestamp DESC LIMIT ?'
  ).bind(employeeId, limit).all();
  
  return results as unknown as TrendPoint[];
}

// Combined queries for dashboard
export async function getEmployeeWithScore(db: D1Database, employeeId: number): Promise<(Employee & { score: Score | null })> {
  const employee = await getEmployeeById(db, employeeId);
  
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`);
  }
  
  const score = await getScoreByEmployeeId(db, employeeId);
  
  return {
    ...employee,
    score
  };
}

export async function getDashboardData(db: D1Database): Promise<{ employees: any[] }> {
  // Get all employees with their scores and recent trend points
  const employees = await getEmployees(db);
  
  const employeesWithData = await Promise.all(
    employees.map(async (employee) => {
      const score = await getScoreByEmployeeId(db, employee.id);
      const trendPoints = await getTrendPointsByEmployeeId(db, employee.id, 10);
      
      return {
        ...employee,
        score: score || null,
        trendPoints
      };
    })
  );
  
  return { employees: employeesWithData };
}

// Transaction helper
export async function runTransaction<T>(db: D1Database, callback: (tx: D1Database) => Promise<T>): Promise<T> {
  try {
    await db.exec('BEGIN TRANSACTION');
    const result = await callback(db);
    await db.exec('COMMIT');
    return result;
  } catch (error) {
    await db.exec('ROLLBACK');
    throw error;
  }
} 