export default function Education({ data }) {
  return (
    <div className="flex items-center justify-center h-fit w-11/12 my-2">
      <div className="w-[20%] flex flex-col items-start justify-start">
        <h2 className="font-sans text-xl mb-2 text-cyan-700">Education</h2>
      </div>
      <div className="w-[80%] flex flex-col items-start justify-center">
        <table className="w-[50%]">
          <tbody>
            {data.map(({ time, content }) => (
              <tr key={time}>
                <td className="text-left align-top font-sans text-sm font-semibold text-neutral-500 pr-2" >
                  {time}
                </td>
                <td className="text-left font-sans text-sm text-neutral-800">
                  {content.map((row, idx) => (
                    <>
                      {row}
                      {idx < content.length - 1 && <br />}
                    </>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
