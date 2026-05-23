/**
 * @file Memory buffer to store pending permission and question requests in the extension host.
 * Serves as the source of truth to ensure no requests are lost if the webview is not active.
 */

import type { PermissionRequest, QuestionRequest } from '@opencode-ai/sdk/v2/client';

/**
 * Stores and manages pending permission and question requests keyed by their respective IDs.
 * Organizes requests so they can be retrieved or cleaned up on a per-session basis.
 */
export class PendingRequestBuffer {
  /** Map storing permission requests keyed by the unique permission ID. */
  private permissions = new Map<string, PermissionRequest>();

  /** Map storing question requests keyed by the unique question/request ID. */
  private questions = new Map<string, QuestionRequest>();

  /**
   * Adds a permission request to the buffer.
   *
   * @param request The permission request from SSE.
   */
  public addPermission(request: PermissionRequest): void {
    if (request.id) {
      this.permissions.set(request.id, request);
    }
  }

  /**
   * Adds a question request to the buffer.
   *
   * @param request The question request from SSE.
   */
  public addQuestion(request: QuestionRequest): void {
    if (request.id) {
      this.questions.set(request.id, request);
    }
  }

  /**
   * Removes a permission request from the buffer.
   *
   * @param id The permission ID to remove.
   */
  public removePermission(id: string): void {
    this.permissions.delete(id);
  }

  /**
   * Removes a question request from the buffer.
   *
   * @param id The question request ID to remove.
   */
  public removeQuestion(id: string): void {
    this.questions.delete(id);
  }

  /**
   * Retrieves all pending permissions and questions belonging to a specific session.
   *
   * @param sessionID The session ID to filter by.
   * @returns An object containing filtered lists of permission and question requests.
   */
  public getBySession(sessionID: string): {
    permissions: PermissionRequest[];
    questions: QuestionRequest[];
  } {
    const sPermissions: PermissionRequest[] = [];
    for (const perm of this.permissions.values()) {
      if (perm.sessionID === sessionID) {
        sPermissions.push(perm);
      }
    }

    const sQuestions: QuestionRequest[] = [];
    for (const q of this.questions.values()) {
      if (q.sessionID === sessionID) {
        sQuestions.push(q);
      }
    }

    return { permissions: sPermissions, questions: sQuestions };
  }

  /**
   * Removes all pending requests associated with a specific session ID.
   *
   * @param sessionID The session ID whose requests should be deleted.
   */
  public removeBySession(sessionID: string): void {
    for (const [id, perm] of this.permissions.entries()) {
      if (perm.sessionID === sessionID) {
        this.permissions.delete(id);
      }
    }
    for (const [id, q] of this.questions.entries()) {
      if (q.sessionID === sessionID) {
        this.questions.delete(id);
      }
    }
  }

  /**
   * Clears all stored permission and question requests.
   */
  public clear(): void {
    this.permissions.clear();
    this.questions.clear();
  }
}
