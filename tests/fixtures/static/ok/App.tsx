import Image from "next/image";

export function App({ caption }: { caption: string }) {
  return (
    <main>
      <h1>ok</h1>
      <Image src="/hero.png" width={10} height={10} alt="東京駅の外観" />
      <img src="/divider.png" alt="" />
      <img src="/photo.png" alt={caption} />
      <label htmlFor="name">名前</label>
      <input id="name" type="text" />
      <button type="button" aria-label="メニューを開く"><svg aria-hidden="true" /></button>
      <button type="button" onClick={() => {}}>開く</button>
      <a href="/details">詳細</a>
    </main>
  );
}
