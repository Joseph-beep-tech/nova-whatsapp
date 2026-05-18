import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, CountBadge } from '../Badge'

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children content', () => {
      render(<Badge>Test Label</Badge>)
      expect(screen.getByText('Test Label')).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('renders default variant', () => {
      render(<Badge>Default</Badge>)
      expect(screen.getByText('Default')).toHaveClass('bg-secondary', 'text-secondary-foreground')
    })

    it('renders primary variant', () => {
      render(<Badge variant="primary">Primary</Badge>)
      expect(screen.getByText('Primary')).toHaveClass('bg-accent', 'text-accent-foreground')
    })

    it('renders success variant', () => {
      render(<Badge variant="success">Success</Badge>)
      expect(screen.getByText('Success')).toHaveClass('bg-green-100', 'text-green-700')
    })

    it('renders warning variant', () => {
      render(<Badge variant="warning">Warning</Badge>)
      expect(screen.getByText('Warning')).toHaveClass('bg-yellow-100', 'text-yellow-700')
    })

    it('renders danger variant', () => {
      render(<Badge variant="danger">Danger</Badge>)
      expect(screen.getByText('Danger')).toHaveClass('bg-red-100', 'text-red-700')
    })

    it('renders info variant', () => {
      render(<Badge variant="info">Info</Badge>)
      expect(screen.getByText('Info')).toHaveClass('bg-blue-100', 'text-blue-700')
    })
  })

  describe('sizes', () => {
    it('renders small size by default', () => {
      render(<Badge>Small</Badge>)
      expect(screen.getByText('Small')).toHaveClass('text-xs')
    })

    it('renders medium size', () => {
      render(<Badge size="md">Medium</Badge>)
      expect(screen.getByText('Medium')).toHaveClass('text-sm')
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<Badge className="my-custom-class">Custom</Badge>)
      expect(screen.getByText('Custom')).toHaveClass('my-custom-class')
    })
  })
})

describe('CountBadge', () => {
  describe('rendering', () => {
    it('renders count', () => {
      render(<CountBadge count={5} />)
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('does not render when count is 0', () => {
      const { container } = render(<CountBadge count={0} />)
      expect(container).toBeEmptyDOMElement()
    })

    it('does not render when count is negative', () => {
      const { container } = render(<CountBadge count={-1} />)
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('max value', () => {
    it('shows max+ when count exceeds default max (99)', () => {
      render(<CountBadge count={100} />)
      expect(screen.getByText('99+')).toBeInTheDocument()
    })

    it('shows exact count when at max', () => {
      render(<CountBadge count={99} />)
      expect(screen.getByText('99')).toBeInTheDocument()
    })

    it('respects custom max value', () => {
      render(<CountBadge count={10} max={9} />)
      expect(screen.getByText('9+')).toBeInTheDocument()
    })

    it('shows exact count when below custom max', () => {
      render(<CountBadge count={9} max={10} />)
      expect(screen.getByText('9')).toBeInTheDocument()
    })
  })

  describe('custom className', () => {
    it('applies custom className', () => {
      render(<CountBadge count={5} className="my-custom-class" />)
      expect(screen.getByText('5')).toHaveClass('my-custom-class')
    })
  })
})
