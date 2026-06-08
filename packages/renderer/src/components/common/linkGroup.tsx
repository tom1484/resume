import React from 'react';
import Link from '@components/common/link';

// Renders a row of labeled links separated by small gaps.
// Shared by experience and publication items.
export default function LinkGroup({
  links = [],
}: {
  links?: { text: string; url: string }[];
}) {
  return links.map(({ text, url }, idx) => (
    <React.Fragment key={idx}>
      <Link href={url} variant="block">
        {text}
      </Link>
      {idx !== links.length - 1 && <div className='mr-1' />}
    </React.Fragment>
  ));
}
