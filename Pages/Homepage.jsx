import Dashboard  from "./Dashboard";
import UserHome   from "./UserHome";

const Homepage = () => {
  const role = localStorage.getItem("role");
  if (role === "admin") return <Dashboard />;
  return <UserHome />;
};

export default Homepage;
