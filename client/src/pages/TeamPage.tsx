import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUser, fetchUsers } from "../lib/api";

export function TeamPage() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"tech" | "admin">("tech");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
  }, []);

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
  };

  const mut = useMutation({
    mutationFn: () => createUser({ email: role === "admin" ? email : undefined, password, name, role }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      clearForm();
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-slate-400">Create accounts for field techs and other admins.</p>
      </div>

      <form
        className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-6 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
      >
        <h2 className="font-medium text-slate-200">New user</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-slate-300">Name {role === "tech" && "(username)"}</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="new-user"
              required
            />
          </label>
          {role === "admin" && (
            <label className="block">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="new-email"
                required
              />
            </label>
          )}
          <label className={role === "tech" ? "block sm:col-span-2" : "block"}>
            <span className="text-slate-300">Password</span>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-300">Role</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23a8adba'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 12px center',
                backgroundSize: '20px',
                backgroundRepeat: 'no-repeat',
                paddingRight: '40px',
              }}
              value={role}
              onChange={(e) => {
                setRole(e.target.value as "tech" | "admin");
                clearForm();
              }}
            >
              <option value="tech">Tech</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={mut.isPending}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
        >
          {mut.isPending ? "Creating…" : "Create user"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 font-medium text-slate-200">All users</h2>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 text-slate-400">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
