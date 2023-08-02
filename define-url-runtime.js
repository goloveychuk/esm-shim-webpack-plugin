let mod;
const originalDefine = globalThis.define;
globalThis.define = (arg1, arg2, arg3) => {
    var isNamedRegister = typeof arg1 === "string";
    var name = isNamedRegister ? arg1 : null;
    var depArg = isNamedRegister ? arg2 : arg1;
    var execArg = isNamedRegister ? arg3 : arg2;

    var deps, exec;

    // define([], function () {})
    if (Array.isArray(depArg)) {
        deps = depArg;
        exec = execArg;
    }
    // define({})
    else if (typeof depArg === "object") {
        deps = [];
        exec = function () {
            return depArg;
        };
    }
    // define(function () {})
    else if (typeof depArg === "function") {
        deps = [];
        exec = depArg;
    } else {
        throw Error("Invalid call to AMD define()");
    }
    if (mod) {
        throw new Error(
            "define is called twice, prevExec:\\n" + mod.exec + "\\nnewExec:\\n" + exec
        );
    }
    mod = { deps, exec };
};

globalThis.define.amd = true;
export default function() {
    globalThis.define = originalDefine;
    const { exec, deps } = mod;
    mod = undefined;
    return { exec, deps };
}