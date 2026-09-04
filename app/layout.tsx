import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wshhh1124.github.io/zhiyu-art-demo/"),
  title: "把自己画回来｜织屿心理",
  description: "无需ChatGPT账号，用颜色、书写与觉察体验7日表达性艺术探索。作品册仅保存在当前设备，不上传。",
  openGraph: {
    title: "把自己画回来｜织屿心理",
    description: "画下此刻，形成7日作品册，并由你决定是否分享。",
    images: ["/og.png"],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
