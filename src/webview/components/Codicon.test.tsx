/**
 * @file Unit and regression tests for the Codicon component.
 * Verifies parsing logic, CSS class generation, and styling application.
 */

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Codicon } from './Codicon';

describe('Codicon Component', () => {
  it('should render null when name is empty or whitespace', () => {
    const { container: container1 } = render(<Codicon name="" />);
    expect(container1.firstChild).toBeNull();

    const { container: container2 } = render(<Codicon name="   " />);
    expect(container2.firstChild).toBeNull();
  });

  it('should parse and render raw icon names', () => {
    const { container } = render(<Codicon name="shield" />);
    const element = container.querySelector('.codicon');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('codicon', 'codicon-shield');
  });

  it('should parse and render VS Code syntax wrapped in $()', () => {
    const { container } = render(<Codicon name="$(person)" />);
    const element = container.querySelector('.codicon');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('codicon', 'codicon-person');
  });

  it('should parse and apply animations/modifiers with tilde', () => {
    const { container } = render(<Codicon name="$(sync~spin)" />);
    const element = container.querySelector('.codicon');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('codicon', 'codicon-sync', 'codicon-modifier-spin');
  });

  it('should parse animations/modifiers without $() wrapper', () => {
    const { container } = render(<Codicon name="sync~spin" />);
    const element = container.querySelector('.codicon');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('codicon', 'codicon-sync', 'codicon-modifier-spin');
  });

  it('should correctly merge custom className prop', () => {
    const { container } = render(<Codicon name="$(shield)" className="custom-class active" />);
    const element = container.querySelector('.codicon');
    expect(element).toBeInTheDocument();
    expect(element).toHaveClass('codicon', 'codicon-shield', 'custom-class', 'active');
  });

  it('should apply style object prop', () => {
    const customStyle = { color: 'red', fontSize: '20px' };
    const { container } = render(<Codicon name="$(shield)" style={customStyle} />);
    const element = container.querySelector('.codicon') as HTMLElement;
    expect(element).toBeInTheDocument();
    expect(element.style.color).toBe('red');
    expect(element.style.fontSize).toBe('20px');
  });
});
