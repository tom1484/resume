// Default configuration
export default {
  layout: {
    containerWidth: 'w-11/12',
    margins: {
      top: 'mb-1',
      bottom: 'mb-1',
      section: 'mb-1'
    },
    spacing: {
      sectionGap: 'mb-1',
      itemGap: 'my-1',
      smallGap: 'mt-1',
      mediumGap: 'ml-5',
      padding: 'p-1',
      paddingRight: 'pr-1'
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
    mainTitle: 'font-bold font-serif text-4xl',
    sectionTitle: 'font-bold font-serif text-xl text-black-700',
    heading: 'font-bold font-serif text-lg',
    subheading: 'font-bold font-serif text-sm font-semibold',
    bodyText: 'font-serif text-sm',
    caption: 'text-xs',
    fontFamily: 'font-serif'
  },
  colors: {
    primary: 'text-neutral-800',
    secondary: 'text-neutral-500',
    accent: 'text-orange-800',
    link: 'text-black-800',
    linkUnderline: 'underline text-black-800',
    highlight: 'font-bold text-cyan',
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
      titleWrapper: 'w-full flex flex-col items-start justify-start mb-1',
      divider: 'h-0.5 w-[100%] border-t-gray-600 bg-gray-600'
    },
    personalInfo: {
      container: 'flex items-center justify-center h-fit',
      table: 'w-[30%]',
      nameSection: 'flex flex-col items-center justify-center w-[40%]',
      qrSection: 'flex flex-row items-center justify-end w-[30%]',
      qrItem: 'mb-2 flex flex-col items-center ml-5',
      qrImage: 'w-15 h-10',
      qrLabel: 'text-xs text-neutral-500 mt-0',
      tableKey: 'text-left font-serif text-sm font-semibold text-neutral-500 pr-2',
      tableValue: 'text-left font-serif text-sm text-neutral-500',
      link: 'text-left font-serif text-sm font-semibold text-black-800 pr-2 mr-3 underline'
    },
    experiences: {
      item: 'flex items-stretch h-fit w-full',
      titleRow: 'flex items-center justify-between h-fit w-full',
      infoRow: 'flex items-center justify-between h-fit w-full mb-1',
      infoRowLeft: 'flex items-center justify-start h-fit',
      infoSplit: 'font-bold font-serif text-left align-center text-sm text-neutral-500 mx-1',
      highlight: 'font-semibold font-serif text-left align-center text-sm text-cyan-800',
      role: 'font-semibold font-serif text-left align-center text-sm text-neutral-500',
      footnote: 'font-semibold font-serif text-neutral-500 text-sm ml-1',
      location: 'font-semibold font-serif text-neutral-500 text-sm ml-1',
      time: 'font-semibold font-serif text-left align-center text-sm text-neutral-500',
      list: 'list-disc list-outside',
      listItem: 'font-serif text-left text-sm text-neutral-800 break-words overflow-wrap-anywhere',
      tags: 'font-semibold font-serif text-left text-sm text-neutral-500 mt-1',
    },
    publications: {
      titleRow: 'flex items-center justify-between h-fit w-full',
      authorRow: 'flex items-center justify-between h-fit w-full',
      authorText: 'font-serif text-sm font-semibold text-neutral-500',
      authorHighlight: 'font-bold text-black'
    },
    education: {
      titleRow: 'flex items-center justify-between h-fit w-full',
      timeText: 'font-semibold font-serif text-left align-center text-sm text-neutral-500',
      table: 'w-[100%] table-fixed',
      tableKey: 'w-[14%] align-center text-left font-serif text-sm font-semibold text-neutral-800 pr-2',
      tableValue: 'text-left align-center font-serif text-sm text-neutral-800'
    },
    skills: {
      wrapper: 'flex flex-col justify-start h-fit w-full',
      category: 'font-bold font-serif text-neutral-600',
      text: 'font-bold font-serif'
    },
    splitLine: {
      default: 'my-1 h-0.5 bg-gray-300 border-0',
      section: 'h-1 bg-gray-600 border-0'
    },
    link: {
      default: 'font-bold font-serif text-sm underline text-neutral-500',
      block: 'font-bold font-serif text-sm underline text-neutral-500'
    }
  }
};

