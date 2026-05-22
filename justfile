set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
    @just --list

verify:
    pnpm run verify:all

doctor:
    pnpm run doctor

actions:
    actionlint

security-audit:
    osv-scanner scan source --recursive --allow-no-lockfiles --experimental-exclude node_modules --experimental-exclude .next --experimental-exclude dist --experimental-exclude build --experimental-exclude target --experimental-exclude archive .

rust-security:
    find . \( -path ./node_modules -o -path ./.git -o -path ./target \) -prune -o -name Cargo.lock -print0 | while IFS= read -r -d "" lock; do dir="$(dirname "$lock")"; (cd "$dir" && cargo audit); done
    find . \( -path ./node_modules -o -path ./.git -o -path ./target \) -prune -o -name Cargo.toml -print0 | while IFS= read -r -d "" manifest; do dir="$(dirname "$manifest")"; if [ -f "$dir/Cargo.lock" ]; then (cd "$dir" && cargo deny check); fi; done

security:
    just actions
    @echo "Dependency audit is available with: just security-audit"
    @echo "Rust audit is available with: just rust-security"
    @echo "This repo has known unresolved dependency advisories; see the local tooling report before making security a required gate."
