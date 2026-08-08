import React from 'react';

// Generates a consistent background color based on string
const stringToColor = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff;
    // Keep colors slightly darker/pastel for better text contrast with white
    const pastel = Math.max(0, Math.min(200, value - 30));
    color += `00${pastel.toString(16)}`.slice(-2);
  }
  return color;
};

// Gets first letter or initials
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length > 1) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const Avatar = ({ name, size = 24, style = {}, title }) => {
  if (!name) return null;
  
  const bgColor = stringToColor(name);
  const initials = getInitials(name);
  
  return (
    <div 
      title={title || name}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        backgroundColor: bgColor,
        color: '#ffffff', // always white text
        fontSize: `${Math.floor(size * 0.45)}px`,
        fontWeight: '600',
        userSelect: 'none',
        ...style
      }}
    >
      {initials}
    </div>
  );
};

export default Avatar;
