import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, hoverable = false, className = '', style = {}, ...props }) => {
  const baseStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '24px',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    ...style
  };

  return (
    <div 
      style={baseStyle} 
      onMouseEnter={(e) => {
        if (hoverable) {
          e.currentTarget.style.borderColor = 'var(--border-color-hover)';
          e.currentTarget.style.background = 'var(--bg-card-hover)';
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.background = 'var(--bg-card)';
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        }
      }}
      className={className} 
      {...props}
    >
      {children}
    </div>
  );
};
export default Card;
