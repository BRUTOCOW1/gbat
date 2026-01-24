import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  duration?: number; // Auto-dismiss after this many milliseconds (0 = no auto-dismiss)
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationsSubject = new Subject<Notification>();
  private notificationIdCounter = 0;

  notifications$: Observable<Notification> = this.notificationsSubject.asObservable();

  /**
   * Show a success notification
   */
  showSuccess(message: string, duration: number = 3000): void {
    this.show({ type: 'success', message, duration });
  }

  /**
   * Show an error notification
   */
  showError(message: string, duration: number = 5000): void {
    this.show({ type: 'error', message, duration });
  }

  /**
   * Show a warning notification
   */
  showWarning(message: string, duration: number = 4000): void {
    this.show({ type: 'warning', message, duration });
  }

  /**
   * Show an info notification
   */
  showInfo(message: string, duration: number = 3000): void {
    this.show({ type: 'info', message, duration });
  }

  /**
   * Show a custom notification
   */
  show(notification: Omit<Notification, 'id'>): void {
    const notificationWithId: Notification = {
      ...notification,
      id: ++this.notificationIdCounter
    };
    this.notificationsSubject.next(notificationWithId);
  }

  /**
   * Convert Supabase/API errors to user-friendly messages
   */
  getErrorMessage(error: any): string {
    if (!error) {
      return 'An unexpected error occurred. Please try again.';
    }

    // Handle Supabase errors
    if (error.message) {
      const message = error.message.toLowerCase();
      
      // Authentication errors
      if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
        return 'Invalid email or password. Please check your credentials and try again.';
      }
      if (message.includes('email not confirmed')) {
        return 'Please check your email and confirm your account before logging in.';
      }
      if (message.includes('user already registered')) {
        return 'An account with this email already exists. Please log in instead.';
      }
      
      // Network errors
      if (message.includes('network') || message.includes('fetch')) {
        return 'Network error. Please check your internet connection and try again.';
      }
      
      // Database errors
      if (message.includes('duplicate key') || message.includes('unique constraint')) {
        return 'This item already exists. Please use a different name.';
      }
      if (message.includes('foreign key') || message.includes('constraint')) {
        return 'Unable to complete this action. Please check your selections and try again.';
      }
      
      // Permission errors
      if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
        return 'You do not have permission to perform this action.';
      }
      
      // Return the error message if it's user-friendly, otherwise return generic message
      if (message.length < 100) {
        return error.message;
      }
    }

    // Handle error objects with code
    if (error.code) {
      switch (error.code) {
        case 'PGRST116':
          return 'The requested item was not found.';
        case '23505': // PostgreSQL unique violation
          return 'This item already exists. Please use a different name.';
        case '23503': // PostgreSQL foreign key violation
          return 'Unable to complete this action. Please check your selections.';
        default:
          return `Error ${error.code}: An error occurred. Please try again.`;
      }
    }

    // Fallback to generic message
    return 'An unexpected error occurred. Please try again.';
  }
}
