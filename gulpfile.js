const gulp = require('gulp');
const sass = require('gulp-sass');
const glob = require('node-sass-globbing');

const jshint = require('gulp-jshint');
const stylish = require('jshint-stylish');
const concat = require('gulp-concat');
const uglify = require('gulp-terser');
const optimizejs = require('gulp-optimize-js');

// Generate CSS from Sass files.
gulp.task('css', function () {
  return gulp.src('./src/scss/main.scss')
    .pipe(sass({
      outputStyle: 'compressed',
      importer: glob
    })
    .on('error', sass.logError))
    .pipe(gulp.dest('./css'));
});

// Do fancy JavaScript stuff.
gulp.task('js', function () {
  return gulp.src('./src/js/*')
    .pipe()
});

// Watch folders for changes.
gulp.task('watch', function () {
  gulp.watch('./src/scss/**/*.scss', gulp.parallel('css'));
});

// Build stuff!!
gulp.task('build', gulp.parallel(
  'css'
));
