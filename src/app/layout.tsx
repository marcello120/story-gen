import type {Metadata} from "next";
import {Cinzel, Cinzel_Decorative, IM_Fell_English} from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
    variable: "--font-cinzel",
    subsets: ["latin"],
    weight: ["400", "700", "900"],
});

const cinzelDeco = Cinzel_Decorative({
    variable: "--font-cinzel-deco",
    subsets: ["latin"],
    weight: ["400", "700", "900"],
});

const fellEnglish = IM_Fell_English({
    variable: "--font-fell",
    subsets: ["latin"],
    weight: "400",
});

export const metadata: Metadata = {
    title: "Mythslop",
    description: "Generate Hero's Journey stories from the Thompson Motif Index",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body
            className={`${cinzel.variable} ${cinzelDeco.variable} ${fellEnglish.variable}`}
        >
        {children}
        </body>
        </html>
    );
}
