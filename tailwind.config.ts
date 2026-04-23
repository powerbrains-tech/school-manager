import type { Config } from "tailwindcss";

const config: Config = {
  // บรรทัดนี้คือหัวใจสำคัญที่บอกให้ระบบเข้าไปอ่านความสวยงามในโฟลเดอร์ src ของเราครับ
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;