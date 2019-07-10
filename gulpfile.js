const gulp = require('gulp');
const sass = require('gulp-sass');

// Generate CSS from Sass files.
gulp.task('css', function() {
  return gulp.src('./src/scss/main.scss')
    .pipe(sass({
      outputStyle: 'compressed'
    })
    .on('error', sass.logError))
    .pipe(gulp.dest('./css'));
});

// Watch folders for changes.
gulp.task('watch', function() {
  gulp.watch('./src/scss/**/*.scss', gulp.parallel('css'));
});

// Build stuff!!
gulp.task('build', gulp.parallel(
  'css'
));
