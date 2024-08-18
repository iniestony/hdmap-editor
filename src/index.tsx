import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  useRoutes,
  Outlet,
} from "react-router-dom";
import Editor from "./pages/editor";
import "./index.scss";

const Routes = () => {
  return useRoutes([
    {
      path: '/',
      element: <Outlet />,
      children: [
        {
          index: true,
          element: <Editor />
        },
        {
          path: '/editor',
          element: <Editor />
        },
      ]
    },
  ])
}

const App = () => (
  <BrowserRouter>
    <Routes />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
