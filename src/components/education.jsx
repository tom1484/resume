export default function Education({ data }) {
  return (
    // <div className="flex items-end justify-center h-fit w-11/12">
    // <h className="w-3/12">Electrical Engineering</h>
    // <h className="w-3/12">National Taiwan University</h>
    // <h className="w-7/12">National Taiwan University</h>
    // </div>
    <>
      <div className="flex flex-col items-end justify-center h-fit w-11/12">
        {data.map(({ time, title, content }) => (
          <>
            <div className="flex items-stretch h-fit w-full my-2">
              <div className="w-[20%] flex flex-col">
                <h2 className="font-sans text-lg">{time}</h2>
              </div>
              <div className="w-[80%] flex flex-col justify-between">
                <h2 className="font-sans text-lg">{title}</h2>
                <table className="w-[100%] table-fixed">
                  <tbody>
                    {
                      content.map(([key, value]) => (
                        <tr key={key}>
                          <td
                            className="w-[15%] align-top text-left font-sans text-sm font-semibold text-neutral-800 pr-2"
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

          </>
        ))}
      </div>
    </>
    // <div className="w-[80%] flex flex-col items-start justify-center">
    // <table className="w-[50%]">
    // <tbody>
    // {data.map(({ time, content }) => (
    //   <tr key={time}>
    //   <td className="text-left align-top font-sans text-sm font-semibold text-neutral-500 pr-2" >
    //   {time}
    //   </td>
    //   <td className="text-left font-sans text-sm text-neutral-800">
    //   {content.map((row, idx) => (
    //     <>
    //     {row}
    //     {idx < content.length - 1 && <br />}
    //     </>
    //   ))}
    //   </td>
    //   </tr>
    // ))}
    // </tbody>
    // </table>
    // </div>
  );
}
