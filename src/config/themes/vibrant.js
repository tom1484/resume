// Vibrant theme - current colorful design
// This is the existing theme configuration

export const vibrantTheme = {
  layout: {
    containerWidth: 'w-11/12',
    margins: {
      top: 'mb-3',
      bottom: 'mb-3',
      section: 'mb-2'
    },
    spacing: {
      sectionGap: 'mb-3',
      itemGap: 'my-1',
      smallGap: 'mt-1',
      mediumGap: 'ml-5',
      padding: 'p-2',
      paddingRight: 'pr-2'
    },
    widths: {
      timeColumn: 'w-[18%] min-w-[18%] max-w-[18%]',
      timeColumnWide: 'w-[22%] min-w-[22%] max-w-[22%]', 
      contentColumn: 'w-[82%] min-w-[82%] max-w-[82%]',
      contentColumnNarrow: 'w-[78%] min-w-[78%] max-w-[78%]',
      personalInfoLeft: 'w-[30%]',
      personalInfoCenter: 'w-[40%]',
      personalInfoRight: 'w-[30%]',
      tableKeyColumn: 'w-[14%]'
    }
  },
  typography: {
    mainTitle: 'font-sans text-4xl',
    sectionTitle: 'font-sans text-xl text-cyan-700',
    heading: 'font-sans text-lg',
    subheading: 'font-sans text-sm font-semibold',
    bodyText: 'font-sans text-sm',
    caption: 'text-xs',
    fontFamily: 'font-sans'
  },
  colors: {
    primary: 'text-neutral-800',
    secondary: 'text-neutral-500',
    accent: 'text-orange-800',
    link: 'text-cyan-800',
    linkUnderline: 'underline text-cyan-800',
    highlight: 'font-bold text-black',
    border: 'border-gray-400',
    divider: 'border-t-gray-400 bg-neutral-300',
    dividerLight: 'bg-neutral-200'
  },
  components: {
    container: {
      main: 'h-full flex flex-col items-center',
      section: 'flex flex-col items-start justify-center h-fit',
      sectionContent: 'flex items-stretch h-fit w-full',
      flexColumn: 'flex flex-col',
      flexRow: 'flex flex-row',
      itemsCenter: 'items-center',
      itemsEnd: 'items-end',
      justifyCenter: 'justify-center',
      justifyStart: 'justify-start',
      justifyEnd: 'justify-end',
      justifyBetween: 'justify-between'
    },
    title: {
      container: 'flex flex-col items-start justify-center h-fit',
      titleWrapper: 'w-full flex flex-col items-start justify-start mb-2',
      divider: 'h-0.5 w-[100%] border-t-gray-400 bg-neutral-300'
    },
    personalInfo: {
      container: 'flex items-center justify-center h-fit',
      table: 'w-[30%]',
      nameSection: 'flex flex-col items-center justify-center w-[40%]',
      qrSection: 'flex flex-row items-center justify-end w-[30%]',
      qrItem: 'mb-2 flex flex-col items-center ml-5',
      qrImage: 'w-20 h-20',
      qrLabel: 'text-xs text-neutral-500 mt-0',
      tableKey: 'text-left font-sans text-sm font-semibold text-neutral-500 pr-2',
      tableValue: 'text-left font-sans text-sm text-neutral-500',
      link: 'text-left font-sans text-sm font-semibold text-cyan-800 pr-2 mr-3 underline'
    },
    experiences: {
      container: 'flex flex-col items-end justify-center h-fit',
      item: 'flex items-stretch h-fit w-full',
      titleRow: 'flex items-center justify-between h-fit w-full',
      timeSection: 'flex flex-col mt-1',
      contentSection: 'flex flex-col justify-between',
      list: 'list-disc list-outside mt-1',
      listItem: 'text-left font-sans text-sm text-neutral-800 break-words overflow-wrap-anywhere',
      tags: 'text-left font-sans text-sm text-neutral-500 mt-1',
      highlight: 'text-left font-sans text-sm text-orange-800',
      timeText: 'text-left align-top font-sans text-sm font-semibold text-neutral-500 pr-2',
      titleFootnote: 'text-neutral-500 text-sm ml-1'
    },
    publications: {
      container: 'flex flex-col items-end justify-center h-fit',
      titleRow: 'flex items-stretch h-fit w-full',
      authorRow: 'flex items-stretch h-fit w-full',
      contentRow: 'flex items-stretch h-fit w-full mb-1',
      timeSection: 'w-[18%] flex flex-col mt-1',
      contentSection: 'w-[82%] flex flex-col justify-between',
      authorText: 'font-sans text-sm font-semibold text-neutral-500',
      authorHighlight: 'font-bold text-black'
    },
    education: {
      container: 'flex flex-col items-end justify-center h-fit',
      item: 'flex items-stretch h-fit w-full my-2',
      timeSection: 'flex flex-col',
      contentSection: 'flex flex-col justify-between',
      table: 'w-[100%] table-fixed',
      tableKey: 'w-[14%] align-top text-left font-sans text-sm font-semibold text-neutral-800 pr-2',
      tableValue: 'text-left font-sans text-sm text-neutral-800'
    },
    skills: {
      container: 'flex flex-col items-end justify-center h-fit',
      wrapper: 'flex flex-wrap justify-start h-fit w-full',
      item: 'flex items-center h-fit w-fit rounded-xl border-gray-400 border p-2 mt-2 mr-3',
      icon: 'h-8 mr-2',
      text: 'font-sans text-sm'
    },
    splitLine: {
      default: 'h-px bg-gray-300 border-0',
      section: 'h-1 bg-gray-600 border-0'
    }
  }
};
