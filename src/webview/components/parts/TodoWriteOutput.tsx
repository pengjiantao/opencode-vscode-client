/**
 * @file Renders the custom todo list body for the `todowrite` tool. Each item
 * shows a status codicon plus its content with visual emphasis varying by
 * state (pending / in_progress / completed / cancelled).
 */

import { Codicon } from '../Codicon';

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'high' | 'medium' | 'low';

/** Shape of a single todo item as defined by the opencode backend (`SessionTodo.Info`). */
export interface TodoItem {
  content: string;
  status: TodoStatus;
  priority: TodoPriority;
}

export interface TodoWriteOutputProps {
  /** The todo list to render. Invalid (non-array) inputs are ignored. */
  todos: ReadonlyArray<TodoItem>;
  /** Current tool execution status; used to flag the live state in the list. */
  status: 'pending' | 'running' | 'completed' | 'error';
}

/**
 * Resolves the codicon name for a given todo status. The webview toolkit
 * fallback is `$(circle-outline)` for any unknown status to avoid breaking
 * the layout on schema additions.
 */
function getStatusIcon(status: TodoStatus): string {
  switch (status) {
    case 'completed':
      return '$(check)';
    case 'in_progress':
      return '$(loading~spin)';
    case 'cancelled':
      return '$(circle-slash)';
    case 'pending':
    default:
      return '$(circle-outline)';
  }
}

/**
 * Renders a single todo entry as a row with a status codicon and the task
 * content. CSS classes (`status-*`, `priority-*`) drive the visual emphasis
 * defined in `parts.css`.
 */
function TodoRow({ todo }: { todo: TodoItem }) {
  return (
    <li className={`todo-item status-${todo.status} priority-${todo.priority}`}>
      <span className="todo-status-icon" aria-hidden="true">
        <Codicon name={getStatusIcon(todo.status)} />
      </span>
      <span className="todo-content">{todo.content}</span>
    </li>
  );
}

/**
 * Renders the todo list body of a `todowrite` tool call. Returns `null` when
 * the input is empty so callers can fall back to the generic tool output
 * rendering.
 */
export function TodoWriteOutput({ todos, status }: TodoWriteOutputProps) {
  if (todos.length === 0) {
    return null;
  }

  return (
    <div className="todo-write-output" data-status={status}>
      <ul className="todo-list">
        {todos.map((todo, idx) => (
          <TodoRow key={`${idx}-${todo.content}`} todo={todo} />
        ))}
      </ul>
    </div>
  );
}
