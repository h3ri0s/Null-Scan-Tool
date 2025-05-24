import { ThemeProvider } from "next-themes"
import "./globals.css"

export const metadata = {
  title: "VAPT",
  description: "VAPT",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
