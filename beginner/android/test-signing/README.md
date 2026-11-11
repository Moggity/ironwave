# Test signing key

`test.keystore` is a public test key. Its passwords are written in `app/build.gradle` and
anyone can read them, so anyone could sign an app with it.

- It exists only so that every CI build of the test APK carries the same signature, which
  lets a new build install over the previous one without uninstalling (and losing data).
- It must never sign a store release. Never upload an APK signed with it to Google Play or
  any other store. A store release needs its own private key, kept out of this repository.
- Keystore type PKCS12, alias `ironwave-test`, RSA 2048, valid for 10000 days.
