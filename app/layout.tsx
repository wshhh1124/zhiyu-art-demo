import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zhiyu-art-demo.wshhh1124.chatgpt.site"),
  title: "把自己画回来｜织屿心理伙伴体验版",
  description: "无需ChatGPT账号，用颜色、书写与觉察体验一次表达性艺术探索。作品不上传、不保存。",
  openGraph: {
    title: "把自己画回来｜伙伴体验版",
    description: "画下此刻，给作品命名，看看你希望怎样被回应。",
    images: ["/og.png"],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
