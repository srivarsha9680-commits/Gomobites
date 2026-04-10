export const metadata = {
    title: 'GoMobites - Restaurant Menu',
    description: 'Order food from your favorite restaurants',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    )
}
