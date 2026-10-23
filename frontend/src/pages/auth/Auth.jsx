

import { h1 } from "motion/react-client";
import { use, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

import LoginComponent from "../../components/LoginComponent";
import RegisterComponent from "../../components/RegisterComponent";

export default function AuthPage() {
    const [page, setPage] = useState("login");

    const { t } = useLanguage();

    return (
        <div className="auth-page login-page" >
            <div className="card">

            <div className="toggle-auth-btn">
                <button onClick={() => setPage("login")} className={page === "login" ? "active" : ""}>{t('login')}</button>
                <button onClick={() => setPage("register")} className={page === "register" ? "active" : ""}>{t('register')}</button>
            </div>
            
            {page === "login" ? (
                <LoginComponent />
            ) : (
                <RegisterComponent />
            )}
            </div>

        </div>
    )
}