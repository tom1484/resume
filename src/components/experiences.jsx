import SplitLine from './splitLine';

export default function Experiences({ title: sectionTitle, data }) {
  // <div className="flex items-start justify-center h-fit w-full my-2">
  return (
    <div className="flex flex-col items-end justify-center h-fit w-11/12 my-2">
      <div className="w-full flex flex-col items-start justify-start">
        <h2 className="font-sans text-xl text-cyan-700">{sectionTitle}</h2>
      </div>

      {data.map(({ title, highlight, time, link, content, tags }, idx) => (
        <>
          <div className="flex items-stretch h-fit w-full my-2">
            <div className="w-[20%] flex flex-col">
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
                      link.map(({ text, url }) => (
                        <>
                          <a
                            href={url}
                            className="underline">
                            {text}
                          </a>
                          &nbsp;&nbsp;
                        </>
                      ))
                    }
                  </>
                }
              </p>
            </div>
            <div className="w-[80%] flex flex-col justify-between">
              <p className="text-left font-sans text-sm text-neutral-800">
                {content.map((row, idx) => (
                  <>
                    {row}
                    {idx < content.length - 1 && <br />}
                  </>
                ))}
              </p>
              <p className="text-left font-sans text-sm text-neutral-500 mt-1">
                {tags.map((tag, idx) => (
                  <>
                    {tag}
                    {idx < tags.length - 1 && " | "}
                  </>
                ))}
              </p>
            </div>
          </div>
          {idx < data.length - 1 && <SplitLine width="[80%]" weight="200" />}
        </>
      ))}
    </div>
  );
}
