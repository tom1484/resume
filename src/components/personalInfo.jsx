export default function PersonalInfo({ data }) {
  return (
    <div className="flex items-center justify-center h-fit w-11/12 my-2">
      <div className="flex flex-col items-start justify-center w-[20%]">
        <img
          src="asset/image/me.jpeg"
          alt="Chu-Rong Chen"
          className="rounded-full w-32"
        />
      </div>
      <div className="flex flex-col items-start justify-center w-[80%]">
        <h1 className="font-sans text-xl mb-2 w-11/12">Chu-Rong Chen</h1>
        <table className="w-11/12">
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
    </div>
  );
}
