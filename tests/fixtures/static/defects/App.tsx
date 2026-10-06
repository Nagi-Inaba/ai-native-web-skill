import Image from "next/image";

export function App() {
  return (
    <div>
      <Image src="/hero.png" width={10} height={10} />
      <img src="/logo.png" alt="画像" />
      <input type="text" />
      <button><svg /></button>
      <div onClick={() => {}}>開く</div>
      <a href="#" onClick={() => {}}>詳細</a>
    </div>
  );
}
