export function App() {
  return (
    <main>
      <button className="outline-none">保存</button>
      <div className={cn("md:order-2", active)} />
      <p className={`text-[14px] leading-[20px]`}>説明</p>
      <button className={clsx("outline-none", "focus-visible:ring-2")}>開く</button>
    </main>
  );
}
