import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  style = {}, 
  disabled,
  ...props 
}) => {
  
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--btn-primary-bg, #ffffff)',
          color: 'var(--btn-primary-text, #000000)',
          border: '1px solid var(--btn-primary-bg, #ffffff)',
        };
      case 'secondary':
        return {
          background: 'rgba(255, 255, 255, 0.04)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        };
      case 'danger':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
    }
  };

  const baseStyle: React.CSSProperties = {
    padding: '10px 18px',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    userSelect: 'none',
    ...getVariantStyles(),
    ...style
  };

  return (
    <button
      style={baseStyle}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'scale(0.98)';
        if (variant === 'primary') {
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.opacity = '0.9';
        } else if (variant === 'secondary') {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.borderColor = 'var(--border-color-hover)';
        } else if (variant === 'danger') {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
        if (variant === 'primary') {
          e.currentTarget.style.background = 'var(--btn-primary-bg, #ffffff)';
          e.currentTarget.style.opacity = '1';
        } else if (variant === 'secondary') {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        } else if (variant === 'danger') {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
};
export default Button;
