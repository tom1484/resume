import React from 'react';
import SplitLine from './splitLine';
import { filterDataByTitles } from '../utils';

export default function Experiences({ title: sectionTitle, data, selectedTitles }) {
  if (selectedTitles && selectedTitles.length > 0) {
    data = filterDataByTitles(data, selectedTitles);
  }

  return (
    <div className="flex flex-col items-end justify-center h-fit w-11/12">

      {data.map(({ title, highlight, time, link, description, content, tags }, idx) => (
        <React.Fragment key={idx}>
          <div className="flex items-stretch h-fit w-full">
            <h2 className="font-sans text-lg">{title}</h2>
          </div>
          <div className="flex items-stretch h-fit w-full mb-1 ">
            <div className="w-[18%] flex flex-col mt-1">
              {
                (highlight && highlight !== '') &&
                <p className="text-left font-sans text-sm text-orange-800">
                  {highlight}
                </p>
              }
              <p className="text-left align-top font-sans text-sm font-semibold text-neutral-500 pr-2">
                {time}
                {
                  (link && link.length) > 0 &&
                  <>
                    <br />
                    Links: {
                      link.map(({ text, url }, idx) => (
                        <React.Fragment key={idx}>
                          <a
                            href={url}
                            className="underline text-cyan-800">
                            {text}
                          </a>
                          &nbsp;&nbsp;
                        </React.Fragment>
                      ))
                    }
                  </>
                }
              </p>
            </div>
            <div className="w-[82%] flex flex-col justify-between">
              {
                // (description && description !== '') &&
                // <p className="text-left font-sans text-lg text-neutral-800">
                //   {description}
                // </p>
              }
              <ul className="list-disc list-inside mt-1">
                {content.map((row, idx) => (
                  <li key={idx} className="text-left font-sans text-sm text-neutral-800" style={{ listStylePosition: 'outside' }}>
                    {
                      row.split('<br>').map((text, i) => (
                        <React.Fragment key={i}>{text}{i < row.split('<br>').length - 1 && <br />}</React.Fragment>
                      ))
                    }
                  </li>
                ))}
              </ul>
              {
                (tags && tags.length > 0) &&
                <p className="text-left font-sans text-sm text-neutral-500 mt-1">
                  {tags.map((tag, idx) => (
                    <React.Fragment key={idx}>
                      {tag}
                      {idx < tags.length - 1 && " | "}
                    </React.Fragment>
                  ))}
                </p>
              }
            </div>
          </div>
          {idx < data.length - 1 && <SplitLine width="[80%]" weight="200" />}
        </React.Fragment>
      ))}
    </div>
  );
}
