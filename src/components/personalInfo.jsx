export default function PersonalInfo({ data }) {
  return (
    <div className="flex items-center justify-center h-fit w-11/12 my-4">
      <div className="flex flex-col items-center justify-center w-[30%]" />
      <div className="flex flex-col items-center justify-center w-[40%]">
        <h1 className="font-sans text-4xl justify-center items-center">Chu-Rong Chen</h1>
      </div>
      <table className="w-[30%]">
        <tbody>
          {
            data.map(([key, value]) => (
              <tr key={key}>
                <td
                  className="text-left font-sans text-sm font-semibold text-neutral-500 pr-2"
                >
                  {key}:
                </td>
                <td className="text-left font-sans text-sm text-neutral-500">
                  {value}
                </td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}
