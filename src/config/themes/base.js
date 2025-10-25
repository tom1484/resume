// Base configuration shared across all themes
// These are structural constants that don't change with theme

export const baseLayout = {
  // Container widths
  containerWidth: 'w-11/12',
  
  // Column width percentages (can be overridden by theme)
  defaultLeftColumnRatio: 22,
  
  // Width presets for special sections
  widths: {
    personalInfoLeft: 'w-[30%]',
    personalInfoCenter: 'w-[40%]',
    personalInfoRight: 'w-[30%]',
    tableKeyColumn: 'w-[14%]'
  }
};

export const baseTypography = {
  fontFamily: 'font-sans'
};
