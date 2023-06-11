"use client";

import { api } from "~/utils/api";
import { type ReactNode } from "react";
import Sidebar from "~/components/Sidebar";
import { Providers } from "~/components/Providers";

import "~/styles/globals.css";
import "~/styles/prism-one-dark.css";

function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex w-screen">
            <aside className="flex">
              <Sidebar />
            </aside>
            <main className="w-full">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

export default api.withTRPC(RootLayout);
