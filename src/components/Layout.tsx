import { useSession } from "next-auth/react";
import { type FC, type ReactNode } from "react";
import Sidebar from "./Sidebar";

const Layout: FC<{ children: ReactNode }> = ({ children }) => {
  const session = useSession();
  return (
    <div className="flex">
      <aside>
        <Sidebar />
      </aside>
      {session.data?.user ? children : null}
    </div>
  );
};

export default Layout;
