import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoginPage } from './login'

describe('LoginPage', () => {
  it('renders email and password inputs', () => {
    render(<LoginPage onLogin={vi.fn()} />)

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    render(<LoginPage onLogin={vi.fn()} />)

    expect(screen.getByRole('button', { name: /sign in$/i })).toBeInTheDocument()
  })

  it('renders SSO button', () => {
    render(<LoginPage onLogin={vi.fn()} />)

    expect(screen.getByRole('button', { name: /sso/i })).toBeInTheDocument()
  })
})
