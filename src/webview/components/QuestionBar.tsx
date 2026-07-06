/**
 * @file Compact interactive question request bar.
 * Replaces PromptInput when there is an active pending question for the current session.
 */

import type { QuestionRequest } from '@opencode-ai/sdk/v2/client';
import { useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { Codicon } from './Codicon';

/** Extended QuestionRequest including an optional sub-agent title. */
interface ExtQuestionRequest extends QuestionRequest {
  subagentTitle?: string;
}

/** Props interface for the QuestionBar component */
interface QuestionBarProps {
  /** The currently active session ID to filter question requests. */
  sessionID: string;
  /** Callback triggered when user replies to a question request with answers. */
  onReply: (requestID: string, answers: string[][]) => void;
  /** Callback triggered when user rejects or dismisses a question request. */
  onReject: (requestID: string) => void;
}

/**
 * QuestionBar renders the interactive question form when the AI asks questions.
 * Handles pagination, radio/checkbox/textarea options, and replies/rejections.
 */
export function QuestionBar({ sessionID, onReply, onReject }: QuestionBarProps) {
  const pendingQuestions = useSessionStore((s) => s.pendingQuestions);
  const removePendingQuestion = useSessionStore((s) => s.removePendingQuestion);

  // Filter pending questions for the active session
  const activeQuestions = pendingQuestions.filter((q) => q.sessionID === sessionID);

  // Note: The AI assistant's question tool blocks further execution until answered.
  // Therefore, there should only ever be at most one pending question request at a time.
  // If multiple exist (e.g. race conditions), we default to rendering the first one.
  if (activeQuestions.length > 1) {
    console.warn(
      `[QuestionBar] Found ${activeQuestions.length} pending question requests. Only the first will be rendered.`,
    );
  }
  const currentRequest: ExtQuestionRequest | undefined = activeQuestions[0];

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Array of arrays representing chosen labels for each question
  const [answers, setAnswers] = useState<string[][]>(() =>
    currentRequest ? currentRequest.questions.map(() => []) : [],
  );
  // Map of question indices to their custom answer state
  const [customAnswers, setCustomAnswers] = useState<
    Record<number, { isSelected: boolean; text: string }>
  >({});

  if (!currentRequest || !currentRequest.questions || currentRequest.questions.length === 0) {
    return null;
  }

  const questions = currentRequest.questions;
  const q = questions[currentQuestionIndex];
  const currentAnswers = answers[currentQuestionIndex] || [];
  const customInfo = customAnswers[currentQuestionIndex] || { isSelected: false, text: '' };

  const hasOptions = q.options && q.options.length > 0;
  // Textarea should show if we allow custom answers AND either there are no options at all
  // or the user explicitly selected the custom answer option checkbox/radio
  const showTextarea = q.custom !== false && (!hasOptions || customInfo.isSelected);

  /**
   * Compiles and formats the answers for all questions to match SDK requirements.
   */
  const getFinalAnswers = (): string[][] => {
    return questions.map((question, idx) => {
      const predefined = answers[idx] || [];
      const info = customAnswers[idx] || { isSelected: false, text: '' };

      const optionsPresent = question.options && question.options.length > 0;
      if (!optionsPresent) {
        if (question.custom !== false) {
          return info.text.trim() ? [info.text.trim()] : [];
        }
        return [];
      } else {
        if (question.custom !== false && info.isSelected) {
          return info.text.trim() ? [...predefined, info.text.trim()] : predefined;
        }
        return predefined;
      }
    });
  };

  /**
   * Handles user interaction with a predefined option.
   */
  const handleOptionSelect = (label: string) => {
    // If there is only one question, which is single-choice, and doesn't allow custom text,
    // we immediately select the option and submit the entire form (skip confirm).
    const isSingleQuestion = questions.length === 1;
    const isSingleChoice = !q.multiple;
    const isNoCustom = q.custom === false;

    if (isSingleQuestion && isSingleChoice && isNoCustom) {
      const finalAnswers = [[label]];
      onReply(currentRequest.id, finalAnswers);
      removePendingQuestion(currentRequest.id);
      return;
    }

    setAnswers((prev) => {
      const next = [...prev];
      const current = next[currentQuestionIndex] || [];
      if (q.multiple) {
        if (current.includes(label)) {
          next[currentQuestionIndex] = current.filter((l) => l !== label);
        } else {
          next[currentQuestionIndex] = [...current, label];
        }
      } else {
        next[currentQuestionIndex] = [label];
        // Deselect the custom answer if the question is single-choice
        setCustomAnswers((prevCustom) => ({
          ...prevCustom,
          [currentQuestionIndex]: {
            ...(prevCustom[currentQuestionIndex] || { text: '' }),
            isSelected: false,
          },
        }));
      }
      return next;
    });
  };

  /**
   * Toggles the "Type your own answer" choice selection status.
   */
  const handleCustomSelectToggle = (selected: boolean) => {
    setCustomAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: {
        ...(prev[currentQuestionIndex] || { text: '' }),
        isSelected: selected,
      },
    }));

    if (selected && !q.multiple) {
      // If it is single-choice, selecting custom answer deselects any predefined options
      setAnswers((prevAnswers) => {
        const next = [...prevAnswers];
        next[currentQuestionIndex] = [];
        return next;
      });
    }
  };

  /**
   * Tracks and updates user text typing for custom responses.
   */
  const handleCustomTextChange = (text: string) => {
    const optionsPresent = q.options && q.options.length > 0;
    setCustomAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: {
        ...(prev[currentQuestionIndex] || { isSelected: !optionsPresent }),
        text,
      },
    }));
  };

  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  /**
   * Advances the layout to the next question page or submits the compiled replies.
   */
  const handleNextOrSubmit = () => {
    if (isLastQuestion) {
      const finalAnswers = getFinalAnswers();
      onReply(currentRequest.id, finalAnswers);
      removePendingQuestion(currentRequest.id);
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  /**
   * Responds to user request cancellation actions.
   */
  const handleReject = () => {
    onReject(currentRequest.id);
    removePendingQuestion(currentRequest.id);
  };

  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="question-bar-wrapper">
      <div className="question-bar-header">
        <div className="question-bar-nav">
          {questions.map((_, idx) => (
            <button
              key={idx}
              className={`question-bar-dot-btn ${idx === currentQuestionIndex ? 'active' : ''}`}
              onClick={() => setCurrentQuestionIndex(idx)}
              data-custom-title={`Go to Question ${idx + 1}`}
            >
              <span className="question-bar-dot" />
            </button>
          ))}
          <span className="question-bar-progress-text">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
        <button
          className="question-bar-dismiss-btn"
          onClick={handleReject}
          data-custom-title="Dismiss this question request"
        >
          <Codicon name="$(close)" />
        </button>
      </div>

      <div className="question-bar-progress-bar-wrapper">
        <div className="question-bar-progress-bar" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="question-bar-body">
        <h3 className="question-bar-title">
          {currentRequest.subagentTitle
            ? `[Sub-agent: ${currentRequest.subagentTitle}] ${q.header || 'Question'}`
            : q.header || 'Question'}
        </h3>
        <p className="question-bar-text">{q.question}</p>

        <div className="question-bar-options">
          {hasOptions &&
            q.options.map((opt, idx) => {
              const isSelected = currentAnswers.includes(opt.label);
              return (
                <label
                  key={idx}
                  className={`question-bar-option-label ${isSelected ? 'selected' : ''}`}
                >
                  <input
                    type={q.multiple ? 'checkbox' : 'radio'}
                    name={`question-${currentQuestionIndex}`}
                    checked={isSelected}
                    onChange={() => handleOptionSelect(opt.label)}
                  />
                  <div className="question-bar-option-content">
                    <span className="question-bar-option-text">{opt.label}</span>
                    {opt.description && (
                      <span className="question-bar-option-desc">{opt.description}</span>
                    )}
                  </div>
                </label>
              );
            })}

          {q.custom !== false && (
            <div className="question-bar-custom-container">
              {hasOptions ? (
                <label
                  className={`question-bar-option-label ${customInfo.isSelected ? 'selected' : ''}`}
                >
                  <input
                    type={q.multiple ? 'checkbox' : 'radio'}
                    name={`question-${currentQuestionIndex}`}
                    checked={customInfo.isSelected}
                    onChange={(e) => handleCustomSelectToggle(e.target.checked)}
                  />
                  <div className="question-bar-option-content">
                    <span className="question-bar-option-text">Type your own answer</span>
                  </div>
                </label>
              ) : null}

              {showTextarea && (
                <textarea
                  className="question-bar-textarea"
                  placeholder={
                    hasOptions ? 'Enter your custom answer here...' : 'Type your answer...'
                  }
                  value={customInfo.text}
                  onChange={(e) => handleCustomTextChange(e.target.value)}
                  rows={3}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="question-bar-footer">
        <button
          className="question-bar-btn question-bar-btn-dismiss"
          onClick={handleReject}
          data-custom-title="Dismiss this question request"
        >
          Dismiss
        </button>

        <div className="question-bar-nav-buttons">
          {questions.length > 1 && (
            <button
              className="question-bar-btn question-bar-btn-back"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              data-custom-title="Go back to previous question"
            >
              Back
            </button>
          )}
          <button
            className="question-bar-btn question-bar-btn-submit"
            onClick={handleNextOrSubmit}
            data-custom-title={isLastQuestion ? 'Submit all answers' : 'Go to next question'}
          >
            {isLastQuestion ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
