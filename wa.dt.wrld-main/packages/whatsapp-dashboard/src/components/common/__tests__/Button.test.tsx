import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '../Button'
import { Mail } from 'lucide-react'

describe('Button', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<Button>Click Me</Button>)
      expect(screen.getByRole('button')).toHaveTextContent('Click Me')
    })

    it('renders with left icon', () => {
      render(<Button leftIcon={<Mail data-testid="left-icon" />}>Send</Button>)
      expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    })

    it('renders with right icon', () => {
      render(<Button rightIcon={<Mail data-testid="right-icon" />}>Send</Button>)
      expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('renders primary variant by default', () => {
      render(<Button>Primary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-primary')
    })

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-secondary')
    })

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-transparent')
    })

    it('renders danger variant', () => {
      render(<Button variant="danger">Danger</Button>)
      expect(screen.getByRole('button')).toHaveClass('bg-destructive')
    })
  })

  describe('sizes', () => {
    it('renders medium size by default', () => {
      render(<Button>Medium</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2')
    })

    it('renders small size', () => {
      render(<Button size="sm">Small</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5')
    })

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>)
      expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3')
    })

    it('renders icon size', () => {
      render(<Button size="icon">Icon</Button>)
      expect(screen.getByRole('button')).toHaveClass('p-2')
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<Button isLoading>Loading</Button>)
      // Loading spinner replaces content
      expect(screen.getByRole('button')).not.toHaveTextContent('Loading')
      expect(screen.getByRole('button').querySelector('svg')).toHaveClass('animate-spin')
    })

    it('hides content when loading', () => {
      render(<Button isLoading leftIcon={<Mail data-testid="icon" />}>Submit</Button>)
      expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
      expect(screen.getByRole('button')).not.toHaveTextContent('Submit')
    })

    it('disables button when loading', () => {
      render(<Button isLoading>Loading</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })

  describe('disabled state', () => {
    it('applies disabled attribute when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('has disabled cursor class', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button')).toHaveClass('disabled:cursor-not-allowed')
    })
  })

  describe('click handling', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click Me</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} disabled>Click Me</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick} isLoading>Click Me</Button>)
      fireEvent.click(screen.getByRole('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<Button className="my-custom-class">Custom</Button>)
      expect(screen.getByRole('button')).toHaveClass('my-custom-class')
    })
  })

  describe('HTML attributes', () => {
    it('passes through HTML attributes', () => {
      render(<Button type="submit" data-testid="submit-btn">Submit</Button>)
      const button = screen.getByTestId('submit-btn')
      expect(button).toHaveAttribute('type', 'submit')
    })
  })
})
