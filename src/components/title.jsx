export default function Title({ title }) {
  return (
    <div className="flex flex-col items-end justify-center h-fit w-11/12">
      <div className="w-full flex flex-col items-start justify-start mb-2">
        <h2 className="font-sans text-xl text-cyan-700">{title}</h2>
      </div>
      <hr className={`h-0.5 w-[100%] border-t-gray-400 bg-neutral-300`} />
    </div>
  );
}
