export default function PersonalInfo({ data }) {
  const info = data.info;
  const link = data.link;
  return (
    <div className="flex items-center justify-center h-fit w-11/12 my-4">
      <table className="w-[30%]">
        <tbody>
          {
            info.map(([key, value]) => (
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
          <tr>
            <td
              className="text-left font-sans text-sm font-semibold text-neutral-500 pr-2"
            >
              Links:
            </td>
            <td className="text-left font-sans text-sm text-neutral-500">
              {
                link.map(([key, value]) => (
                  <a
                    key={key}
                    href={value}
                    className="text-left font-sans text-sm font-semibold text-cyan-800 pr-2 mr-3 underline"
                  >
                    {key}
                  </a>
                ))
              }
            </td>
          </tr>
        </tbody>
      </table>
      <div className="flex flex-col items-center justify-center w-[40%]">
        <h1 className="font-sans text-4xl justify-center items-center">Chu-Rong Chen</h1>
      </div>
      <div className="flex flex-row items-center justify-end w-[30%]">
        {data.qrcodes && data.qrcodes.map(([key, value]) => (
          <div key={key} className="mb-2 flex flex-col items-center ml-5">
            <img
              src={`/asset/image/${value}`}
              alt={`${key} QR code`}
              className="w-20 h-20"
            />
            <span className="text-xs text-neutral-500 mt-1">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
