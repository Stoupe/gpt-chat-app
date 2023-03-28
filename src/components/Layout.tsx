import { useSession } from "next-auth/react";
import { type FC, type ReactNode } from "react";
import Sidebar from "./Sidebar";

const Layout: FC<{ children: ReactNode }> = ({ children }) => {
  const session = useSession();
  return (
    <div className="flex">
      <aside className="sticky top-0 left-0">
        <Sidebar />
      </aside>
      {session.data?.user ? children : null}
    </div>
  );
};

export default Layout;
