echo -n Running tests ts_tests/*.success.ts
./node_modules/.bin/tsc --lib es2015,dom --noEmit ts_tests/*.success.ts || exit 1
echo " OK"
for file in ts_tests/*.fail.ts; do
  echo -n Running test $file ...
  ./node_modules/.bin/tsc --lib es2015,dom --noEmit $file &> /dev/null \
    && echo "Unexpected pass." && exit 1
  echo " OK"
done
