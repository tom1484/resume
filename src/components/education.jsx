export default function Education({ data }) {
  return (
    <>
      <div className="flex flex-col items-end justify-center h-fit w-11/12">
        {data.map(({ time, title, content }, idx) => (
          <div key={idx} className="flex items-stretch h-fit w-full my-2">
            <div className="w-[18%] flex flex-col">
              <h2 className="font-sans text-lg">{time}</h2>
            </div>
            <div className="w-[82%] flex flex-col justify-between">
              <h2 className="font-sans text-lg">{title}</h2>
              <table className="w-[100%] table-fixed">
                <tbody>
                  {
                    content.map(([key, value]) => (
                      <tr key={key}>
                        <td
                          className="w-[14%] align-top text-left font-sans text-sm font-semibold text-neutral-800 pr-2"
                        >
                          {key}:
                        </td>
                        <td className="text-left font-sans text-sm text-neutral-800">
                          {value}
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
