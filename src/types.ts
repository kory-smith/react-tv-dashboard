/// <reference types="@cloudflare/workers-types" />

// Environment type for Cloudflare Workers
export interface Env {
  // D1 Database binding
  DB: D1Database;
  
  // KV Session Store binding
  SESSION_STORE: KVNamespace;
  
  // Static content binding for assets
  __STATIC_CONTENT: KVNamespace;
}

// Auth & Session types
export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface SessionData {
  userId: number;
  expires: number;
}

// User types
export enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE'
}

export interface User {
  id: number;
  email: string;
  hashedPassword: string;
  role: Role;
  employeeId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  email: string;
  hashedPassword: string;
  role: Role;
  employeeId: number | null;
}

export interface UpdateUserData {
  email?: string;
  password?: string;
  role?: Role;
  employeeId?: number | null;
}

// Employee types
export interface Employee {
  id: number;
  name: string;
  wrongNumbers: number;
}

export interface CreateEmployeeData {
  name: string;
  wrongNumbers?: number;
}

export interface UpdateEmployeeData {
  name?: string;
  wrongNumbers?: number;
}

// Score types
export interface Score {
  id: number;
  employeeId: number;
  day: number;
  week: number;
  month: number;
  updatedAt: string;
}

export interface UpdateScoreRequest {
  day?: number;
  week?: number;
  month?: number;
}

export interface ScoreUpdateEvent {
  type: 'wrongNumber' | 'manualUpdate';
  timestamp: string;
  employeeId: number;
  change: number;
}

// TrendPoint types
export interface TrendPoint {
  id: number;
  employeeId: number;
  timestamp: string;
  score: number;
}

// Dashboard types
export interface DashboardData {
  employees: (Employee & {
    score: Score;
    trendPoints: TrendPoint[];
  })[];
}

export interface EmployeeWithScore extends Employee {
  scores: Score | null;
} 