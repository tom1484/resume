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
          <div className="flex items-stretch h-fit w-full my-2">
            <div className="w-[22%] flex flex-col">
              <h2 className="font-sans text-lg">{title}</h2>
              {
                highlight !== '' &&
                <p className="text-left font-sans text-sm text-orange-800">
                  {highlight}
                </p>
              }
              <p className="text-left align-top font-sans text-sm font-semibold text-neutral-500 pr-2">
                {time}
                {
                  link.length > 0 &&
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
            <div className="w-[78%] flex flex-col justify-between">
              {
                description !== '' &&
                <p className="text-left font-sans text-lg text-neutral-800">
                  {description}
                </p>
              }
              <ul className="list-disc list-inside mt-1">
                {content.map((row, idx) => (
                  <li key={idx} className="text-left font-sans text-sm text-neutral-800">
                    {row}
                  </li>
                ))}
              </ul>
              <p className="text-left font-sans text-sm text-neutral-500 mt-1">
                {tags.map((tag, idx) => (
                  <React.Fragment key={idx}>
                    {tag}
                    {idx < tags.length - 1 && " | "}
                  </React.Fragment>
                ))}
              </p>
            </div>
          </div>
          {idx < data.length - 1 && <SplitLine width="[80%]" weight="200" />}
        </React.Fragment>
      ))}
    </div>
  );
}
