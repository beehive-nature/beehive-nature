{
  description = "Pinned native NixOS invitation convergence validation shell";
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  outputs = { self, nixpkgs }: let
    systems = [ "x86_64-linux" "aarch64-linux" ];
  in {
    devShells = nixpkgs.lib.genAttrs systems (system: let
      pkgs = import nixpkgs { inherit system; };
    in {
      default = pkgs.mkShell {
        packages = with pkgs; [ rustup pkg-config openssl clang cmake perl git time util-linux libopus ];
        LIBCLANG_PATH = "${pkgs.libclang.lib}/lib";
        shellHook = ''
          echo "Invitation validation: pinned Rust 1.95.0; execute tests only in the isolated runtime."
        '';
      };
    });
  };
}
