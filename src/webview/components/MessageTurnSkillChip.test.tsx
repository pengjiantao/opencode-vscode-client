/**
 * @file Regression tests for inline skill chip rendering in user message turns.
 */

import type { Part } from '@opencode-ai/sdk/v2/client';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockTextPart, createMockUserMessage } from '../../test/mocks/sdk';
import { MessageTurn } from './MessageTurn';

describe('MessageTurn skill chips', () => {
  function createSkillPart(name: string, overrides: Record<string, unknown> = {}): Part {
    return {
      type: 'text',
      id: 'part-skill',
      sessionID: 'session-1',
      messageID: 'msg-1',
      text: 'Review the selected code for quality issues.',
      metadata: {
        type: 'skill',
        name,
        description: 'Review quality',
        ...overrides,
      },
    } as unknown as Part;
  }

  it('regression: renders a skill chip at the [Skill: name] placeholder without duplicating it below', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart('Use [Skill: code-review] to review vm-module');
    textPart.messageID = userMsg.id;

    const skillPart = createSkillPart('code-review');
    skillPart.messageID = userMsg.id;

    const { container } = render(
      <MessageTurn userMessage={userMsg} parts={{ [userMsg.id]: [textPart, skillPart] }} />,
    );

    const userMessage = container.querySelector('.user-message');
    const skillChips = container.querySelectorAll('.opencode-chip.skill-chip');

    expect(skillChips).toHaveLength(1);
    expect(skillChips[0]).toHaveTextContent('code-review');
    expect(userMessage?.textContent).toContain('Use code-review to review vm-module');
    expect(userMessage?.textContent).not.toContain('[Skill: code-review]');
  });

  it('regression: restores a missing skill placeholder using stored offsets', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart('使用 审查 [File: native-tools] 中的代码');
    textPart.messageID = userMsg.id;

    const skillPart = createSkillPart('code-review-and-quality', {
      placeholder: '[Skill: code-review-and-quality]',
      startOffset: 3,
    });
    skillPart.messageID = userMsg.id;

    const filePart = {
      type: 'file',
      id: 'part-file',
      sessionID: 'session-1',
      messageID: userMsg.id,
      mime: 'application/x-directory',
      filename: 'native-tools',
      url: 'file:///workspace/native-tools',
    } as unknown as Part;

    const { container } = render(
      <MessageTurn
        userMessage={userMsg}
        parts={{ [userMsg.id]: [textPart, skillPart, filePart] }}
      />,
    );

    const content = container.querySelector('.user-message')?.textContent || '';
    const skillChips = container.querySelectorAll('.opencode-chip.skill-chip');

    expect(skillChips).toHaveLength(1);
    expect(content.indexOf('使用')).toBeLessThan(content.indexOf('code-review-and-quality'));
    expect(content.indexOf('code-review-and-quality')).toBeLessThan(content.indexOf('审查'));
  });

  it('regression: restores legacy missing skill placeholders before the prompt action text', () => {
    const userMsg = createMockUserMessage();
    const textPart = createMockTextPart('使用 审查 [File: native-tools] 中的代码');
    textPart.messageID = userMsg.id;

    const skillPart = createSkillPart('code-review-and-quality');
    skillPart.messageID = userMsg.id;

    const filePart = {
      type: 'file',
      id: 'part-file',
      sessionID: 'session-1',
      messageID: userMsg.id,
      mime: 'application/x-directory',
      filename: 'native-tools',
      url: 'file:///workspace/native-tools',
    } as unknown as Part;

    const { container } = render(
      <MessageTurn
        userMessage={userMsg}
        parts={{ [userMsg.id]: [textPart, skillPart, filePart] }}
      />,
    );

    const content = container.querySelector('.user-message')?.textContent || '';
    const skillChips = container.querySelectorAll('.opencode-chip.skill-chip');

    expect(skillChips).toHaveLength(1);
    expect(content.indexOf('使用')).toBeLessThan(content.indexOf('code-review-and-quality'));
    expect(content.indexOf('code-review-and-quality')).toBeLessThan(content.indexOf('审查'));
  });
});
