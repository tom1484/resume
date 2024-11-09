export default function Skills({ data }) {
  return (
    <div className="flex flex-col items-end justify-center h-fit w-11/12">
      <div className="flex flex-wrap justify-start h-fit w-full">
        {
          data.map(({ title, icon }, idx) => (
            <div key={title} className="flex items-center h-fit w-fit rounded-xl border-gray-400 border p-2 mr-3 mb-2">
              <img src={`asset/image/${icon}`} alt={title} className="h-12 mr-2" />
              <h2 className="font-sans text-lg">{title}</h2>
            </div>
          ))
        }
      </div>
    </div>
  );
}
