export function Layout({ children }: { children: unknown }) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>TIL</title>
                <link rel="stylesheet" href="/static/style.css" />
                <script src="/static/htmx.min.js"></script>
            </head>
            <body>
                <header><a href="/">TIL</a></header>
                <nav><a href="/">Modules</a></nav>
                <main id="content">{children}</main>
            </body>
        </html>
    );
}
